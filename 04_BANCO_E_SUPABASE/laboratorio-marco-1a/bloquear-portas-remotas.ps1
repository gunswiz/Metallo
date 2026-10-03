# Bloqueia conexoes de entrada externas nas portas reservadas ao laboratorio local.
# Requer PowerShell elevado. O trafego de loopback continua disponivel para os testes.
$ErrorActionPreference = 'Stop'
$name = 'MetalloSupabaseLocalOnly'
$rule = Get-NetFirewallRule -Name $name -ErrorAction SilentlyContinue
if (-not $rule) {
  New-NetFirewallRule -Name $name `
    -DisplayName 'Metallo laboratorio Supabase - bloquear acesso remoto' `
    -Direction Inbound -Action Block -Enabled True -Profile Any `
    -Protocol TCP -LocalPort '54320-54329' -RemoteAddress Any `
    -PolicyStore PersistentStore | Out-Null
} else {
  Enable-NetFirewallRule -Name $name
}
