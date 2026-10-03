# Executar com privilegio de administrador. Nao reinicia o Windows automaticamente.
$ErrorActionPreference = 'Stop'
$logPath = Join-Path $PSScriptRoot 'instalacao-wsl2.log'
"Inicio: $(Get-Date -Format o)" | Set-Content -LiteralPath $logPath
& wsl.exe --install --no-distribution 2>&1 | Tee-Object -FilePath $logPath -Append
exit $LASTEXITCODE
